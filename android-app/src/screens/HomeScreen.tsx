import React, { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Animated, FlatList, Image, Pressable, StatusBar, StyleSheet, Text, TextInput, View, useWindowDimensions, type StyleProp, type ViewStyle } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Lucide, type LucideIconName } from '@react-native-vector-icons/lucide';
import type { Attendance, AttendanceStatus, Child, ClassLevel, Session } from '../types';

const COLORS = ['#f58a37', '#58b776', '#f7c52f', '#ed6960', '#69a0ee'];
const CLASS_FILTERS: Array<{ id: ClassLevel | 'ALL'; label: string }> = [
  { id: 'ALL', label: 'Toutes les classes' },
  { id: 'FIRST', label: 'Classe 1' },
  { id: 'SECOND', label: 'Classe 2' },
  { id: 'THIRD', label: 'Classe 3' },
];

interface HomeScreenProps {
  session: Session;
  childRecords: Child[];
  attendance: Attendance[];
  alertsCount: number;
  onSaveAttendance: (childId: string, date: string, status: AttendanceStatus) => void;
  onAddChild: () => void;
  onSelectChild: (childId: string) => void;
  onChildren: () => void;
  onFamilies: () => void;
  onEvents: () => void;
  onNotifications: () => void;
  onResources: () => void;
  onAdmin: () => void;
  onSignOut: () => void;
  isAdmin: boolean;
  syncing: boolean;
  online: boolean | null;
  syncMessage: string;
}

export const HomeScreen = memo(function HomeScreen({
  session, childRecords: children, attendance, alertsCount, onSaveAttendance, onAddChild, onSelectChild, onChildren, onFamilies,
  onEvents, onNotifications, onResources, onAdmin, onSignOut, isAdmin, syncing, online, syncMessage,
}: HomeScreenProps) {
  const { width: windowWidth } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const actionSize = Math.max(40, Math.min(44, (windowWidth - insets.left - insets.right - 40 - 40) / 5.72));
  const [query, setQuery] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [activeClass, setActiveClass] = useState<ClassLevel | 'ALL'>('ALL');
  const [toolbarOffset, setToolbarOffset] = useState(0);
  const [stickyActions, setStickyActions] = useState(false);
  const [attendanceMode, setAttendanceMode] = useState(false);
  const [attendanceDate, setAttendanceDate] = useState(() => sundayOf(new Date()));
  const [expandedAttendanceChild, setExpandedAttendanceChild] = useState<string | null>(null);
  const [dateTransition] = useState(() => new Animated.Value(1));
  const stickyActionsRef = useRef(false);
  const listRef = useRef<FlatList<Child>>(null);
  const [stickyOpacity] = useState(() => new Animated.Value(0));
  const [stickyTranslation] = useState(() => new Animated.Value(-8));

  const activeChildren = useMemo(() => children
    .filter(child => !child.notes?.includes('[ARCHIVE]') && (child.firstName.trim() || child.lastName.trim() || child.postName.trim()))
    .map(child => {
      const displayName = formatName(child);
      return { child, displayName, normalizedName: displayName.toLocaleLowerCase('fr-FR') };
    })
    .sort((a, b) => a.displayName.localeCompare(b.displayName, 'fr-FR')),
  [children]);
  const visibleChildren = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase('fr-FR');
    return activeChildren.filter(({ child, normalizedName }) => {
      if (activeClass !== 'ALL' && child.classLevel !== activeClass) return false;
      if (!needle) return true;
      return normalizedName.includes(needle)
        || (child.parentName ?? '').toLocaleLowerCase('fr-FR').includes(needle)
        || child.parentPhone.toLocaleLowerCase('fr-FR').includes(needle);
    }).map(({ child }) => child);
  }, [activeChildren, activeClass, query]);
  const attendanceStatus = useMemo(() => new Map(attendance.filter(item => item.date === attendanceDate).map(item => [item.childId, item.status])), [attendance, attendanceDate]);
  const markedCount = useMemo(() => visibleChildren.filter(child => attendanceStatus.has(child.id)).length, [attendanceStatus, visibleChildren]);
  const nextUnmarkedChild = (date: string, afterChildId?: string) => {
    const markedIds = new Set(attendance.filter(item => item.date === date).map(item => item.childId));
    if (afterChildId) markedIds.add(afterChildId);
    const startIndex = afterChildId ? activeChildren.findIndex(item => item.child.id === afterChildId) + 1 : 0;
    return activeChildren.slice(Math.max(0, startIndex)).find(item => !markedIds.has(item.child.id))?.child.id ?? null;
  };
  const scrollToAttendanceChild = (childId: string | null) => {
    if (!childId) return;
    const index = visibleChildren.findIndex(child => child.id === childId);
    if (index < 0) return;
    requestAnimationFrame(() => {
      listRef.current?.scrollToIndex({ index, animated: true, viewPosition: 0.48 });
    });
  };
  const renderChild = useCallback(({ item, index }: { item: Child; index: number }) => attendanceMode ? (
    <CallChildRow child={item} color={COLORS[index % COLORS.length]} status={attendanceStatus.get(item.id)} expanded={expandedAttendanceChild === item.id}
      onToggle={() => setExpandedAttendanceChild(current => current === item.id ? null : item.id)}
      onSetStatus={status => { onSaveAttendance(item.id, attendanceDate, status); const nextChild = nextUnmarkedChild(attendanceDate, item.id); setExpandedAttendanceChild(nextChild); scrollToAttendanceChild(nextChild); }} />
  ) : <ChildRow child={item} color={COLORS[index % COLORS.length]} animateEntrance={index < 10} entranceDelay={index * 24} onPress={onSelectChild} />
  , [activeChildren, attendance, attendanceDate, attendanceMode, attendanceStatus, expandedAttendanceChild, onSaveAttendance, onSelectChild, visibleChildren]);
  useEffect(() => {
    if (!attendanceMode) return;
    dateTransition.setValue(0.84);
    const animation = Animated.timing(dateTransition, { toValue: 1, duration: 240, useNativeDriver: true });
    animation.start();
    return () => animation.stop();
  }, [attendanceDate, attendanceMode, dateTransition]);
  const currentFilter = CLASS_FILTERS.find(filter => filter.id === activeClass)?.label ?? 'Toutes les classes';
  const filterMenuLabel = (filter: typeof CLASS_FILTERS[number]) => filter.id === 'ALL' ? 'Tous' : filter.label;
  useEffect(() => {
    const animation = Animated.parallel([
      Animated.timing(stickyOpacity, { toValue: stickyActions ? 1 : 0, duration: 170, useNativeDriver: true }),
      Animated.timing(stickyTranslation, { toValue: stickyActions ? 0 : -8, duration: 170, useNativeDriver: true }),
    ]);
    animation.start();
    return () => animation.stop();
  }, [stickyActions, stickyOpacity, stickyTranslation]);
  const renderToolbar = (sticky = false) => <View
    onLayout={sticky ? undefined : event => setToolbarOffset(event.nativeEvent.layout.y)}
    accessibilityElementsHidden={sticky ? !stickyActions : stickyActions}
    importantForAccessibility={sticky === stickyActions ? 'auto' : 'no-hide-descendants'}
    style={[styles.toolbar, { width: actionSize * 5.72 + 40 }, attendanceMode && styles.callToolbar, sticky && styles.stickyToolbarRow]}
  >
    <ActionButton size={actionSize} label={attendanceMode ? 'Appel en cours' : 'Faire l’appel'} kind="speaker" highlighted={attendanceMode} onPress={() => {
      if (attendanceMode) return;
      setSearchOpen(false);
      setMenuOpen(false);
      setFiltersOpen(false);
      setActiveClass('ALL');
      setQuery('');
      listRef.current?.scrollToOffset({ offset: 0, animated: true });
      const callDate = sundayOf(new Date());
      setAttendanceDate(callDate);
      setExpandedAttendanceChild(nextUnmarkedChild(callDate));
      setAttendanceMode(true);
    }} />
    <ActionButton size={actionSize} label="Ajouter un enfant" kind="plus" onPress={onAddChild} />
    <ActionButton size={actionSize} label={searchOpen ? 'Fermer la recherche' : 'Rechercher'} kind="search" onPress={() => {
      const openingSearch = !searchOpen;
      if (openingSearch && stickyActions) listRef.current?.scrollToOffset({ offset: 0, animated: true });
      setSearchOpen(openingSearch);
      setMenuOpen(false);
      if (searchOpen) setQuery('');
    }} />
    <TactilePressable accessibilityLabel={`${alertsCount} notifications`} onPress={onNotifications} style={[styles.actionButton, { width: actionSize, height: actionSize, borderRadius: actionSize / 2 }]}>
      <Icon kind="bell" color={PALETTE.icon} />
      {alertsCount > 0 ? <View style={styles.badge}><Text style={styles.badgeText}>{alertsCount > 99 ? '99+' : alertsCount}</Text></View> : null}
    </TactilePressable>
    <TactilePressable accessibilityLabel={menuOpen ? 'Fermer le menu du profil' : 'Ouvrir le menu du profil'} onPress={() => {
      const openingMenu = !menuOpen;
      if (openingMenu && stickyActions) listRef.current?.scrollToOffset({ offset: 0, animated: true });
      setMenuOpen(openingMenu);
      setSearchOpen(false);
      setFiltersOpen(false);
    }} style={[styles.profileButton, { width: actionSize * 1.72, height: actionSize, borderRadius: actionSize / 2 }, menuOpen && styles.profileButtonOpen]}>
      <View style={[styles.profileAvatar, { width: actionSize - 7, height: actionSize - 7, borderRadius: (actionSize - 7) / 2 }]}>
        <Text style={styles.profileText}>{session.name.trim().charAt(0).toLocaleUpperCase('fr-FR') || 'G'}</Text>
      </View>
      <Icon kind={menuOpen ? 'chevron-up' : 'chevron'} color={menuOpen ? PALETTE.root : PALETTE.icon} />
    </TactilePressable>
  </View>;

  return <SafeAreaView style={styles.root} edges={['top', 'left', 'right', 'bottom']}>
    <StatusBar barStyle="light-content" backgroundColor={PALETTE.root} />
    <FlatList
      ref={listRef}
      data={menuOpen ? [] : visibleChildren}
      keyExtractor={child => child.id}
      renderItem={renderChild}
      ListHeaderComponent={<View style={[styles.header, attendanceMode && styles.callHeader]}>
        <Text style={styles.brand}>ÉCHO DU CIEL · GOSHEN</Text>
        {attendanceMode ? <Animated.View style={[styles.dateStrip, { opacity: dateTransition, transform: [{ translateY: dateTransition.interpolate({ inputRange: [0, 1], outputRange: [7, 0] }) }] }]}>{dateWindow(attendanceDate).map(day => <Pressable key={day.date} disabled={day.date > localDate(new Date())} accessibilityRole="button" accessibilityState={{ selected: day.date === attendanceDate }} onPress={() => { listRef.current?.scrollToOffset({ offset: 0, animated: true }); setAttendanceDate(day.date); setExpandedAttendanceChild(nextUnmarkedChild(day.date)); }} style={[styles.dateTile, day.date === attendanceDate && styles.dateTileActive, day.date > localDate(new Date()) && styles.futureDateTile]}><Text style={[styles.dateNumber, day.date === attendanceDate && styles.dateNumberActive]}>{day.number}</Text><Text style={[styles.dateWeekday, day.date === attendanceDate && styles.dateWeekdayActive]}>{day.weekday}</Text></Pressable>)}</Animated.View> : <>
          <Text style={styles.title}>{menuOpen ? 'Menu' : 'Enfants'}</Text>
          <Text style={styles.subtitle}>{menuOpen ? 'Mon espace' : searchOpen && activeClass === 'ALL' ? 'École du Dimanche' : activeClass === 'ALL' ? `${activeChildren.length} ${activeChildren.length === 1 ? 'enfant' : 'enfants'} · École du Dimanche` : `Filtre actif : ${currentFilter}`}</Text>
        </>}
        {renderToolbar()}
        {menuOpen ? <ProfileMenu session={session} isAdmin={isAdmin} onChildren={onChildren} onFamilies={onFamilies} onEvents={onEvents} onResources={onResources} onAdmin={onAdmin} onSignOut={onSignOut} /> : null}
        {!menuOpen && !attendanceMode && (online === false || syncing) ? <View style={styles.connection} accessibilityLiveRegion="polite">
          <View style={[styles.connectionDot, syncing ? styles.syncDot : online ? styles.onlineDot : styles.offlineDot]} />
          <Text style={styles.connectionText}>{syncing ? 'Synchronisation automatique' : online ? 'En ligne · synchronisation active' : 'Hors ligne · données sur cet appareil'}</Text>
        </View> : null}
        {!menuOpen && !attendanceMode && syncMessage && syncMessage !== 'Données synchronisées.' && syncMessage !== 'Connectez-vous à Internet pour synchroniser.'
          ? <Text accessibilityRole="alert" style={styles.syncError}>{syncMessage}</Text>
          : null}
        {!menuOpen && !attendanceMode && searchOpen ? <AnimatedPanel style={styles.searchPanel}><View style={styles.searchRow}>
          <View style={styles.searchIcon}><Icon kind="search" color={PALETTE.muted} /></View>
          <TextInput
            autoFocus
            value={query}
            onChangeText={setQuery}
            placeholder="Rechercher un enfant ou un parent"
            placeholderTextColor={PALETTE.muted}
            style={styles.searchInput}
            returnKeyType="search"
            accessibilityLabel="Rechercher un enfant ou un parent"
          />
          <Pressable accessibilityRole="button" accessibilityLabel={query ? 'Effacer la recherche' : 'Fermer la recherche'} onPress={() => {
            if (query) setQuery('');
            else setSearchOpen(false);
          }} style={styles.clearSearch}>
            <Icon kind="close" color={PALETTE.muted} />
          </Pressable>
        </View></AnimatedPanel> : null}
        {!menuOpen && !attendanceMode && searchOpen ? <View style={styles.resultMeta}>
          <Text style={styles.resultCount}>{query.trim() ? `${visibleChildren.length} ${visibleChildren.length === 1 ? 'résultat' : 'résultats'} pour « ${query.trim()} »` : `${visibleChildren.length} ${visibleChildren.length === 1 ? 'enfant trouvé' : 'enfants trouvés'}`}</Text>
        </View> : null}
      </View>}
      ListEmptyComponent={menuOpen ? null : <Text style={styles.emptyText}>{emptyMessage(query, activeClass, activeChildren.length, online)}</Text>}
      contentContainerStyle={[styles.listContent, attendanceMode && styles.callListContent]}
      initialNumToRender={14}
      maxToRenderPerBatch={14}
      windowSize={7}
      removeClippedSubviews={false}
      keyboardShouldPersistTaps="handled"
      scrollEventThrottle={16}
      onScrollToIndexFailed={info => {
        listRef.current?.scrollToOffset({ offset: Math.max(0, info.averageItemLength * info.index), animated: true });
        setTimeout(() => listRef.current?.scrollToIndex({ index: info.index, animated: true, viewPosition: 0.48 }), 250);
      }}
      onScroll={event => {
        const shouldStick = toolbarOffset > 0 && event.nativeEvent.contentOffset.y >= toolbarOffset;
        if (shouldStick !== stickyActionsRef.current) {
          stickyActionsRef.current = shouldStick;
          setStickyActions(shouldStick);
        }
      }}
    />
    {!attendanceMode ? <Animated.View pointerEvents={stickyActions ? 'auto' : 'none'} accessibilityElementsHidden={!stickyActions} importantForAccessibility={stickyActions ? 'auto' : 'no-hide-descendants'} style={[styles.stickyToolbar, { top: insets.top, opacity: stickyOpacity, transform: [{ translateY: stickyTranslation }] }]}>
      {renderToolbar(true)}
    </Animated.View> : <View style={styles.callFooter}><Pressable accessibilityRole="button" onPress={() => { setAttendanceMode(false); setExpandedAttendanceChild(null); }} style={styles.finishCallButton}><Text style={styles.finishCallText}>Terminer l’appel · {markedCount}/{visibleChildren.length}</Text></Pressable></View>}
    {!attendanceMode && filtersOpen ? <Pressable
      accessibilityRole="button"
      accessibilityLabel="Fermer les filtres"
      onPress={() => setFiltersOpen(false)}
      style={styles.filterScrim}
    /> : null}
    {!attendanceMode && !menuOpen ? <View pointerEvents="box-none" style={styles.floatingWrap}>
      {filtersOpen ? <AnimatedPanel style={styles.filterMenu}>
        {CLASS_FILTERS.map(filter => <Pressable key={filter.id} accessibilityRole="button" accessibilityLabel={`Filtrer : ${filterMenuLabel(filter)}`} onPress={() => {
          setActiveClass(filter.id);
          setFiltersOpen(false);
        }} accessibilityState={{ selected: activeClass === filter.id }} style={[styles.filterOption, activeClass === filter.id && styles.activeFilterOption]}>
          <Text style={[styles.filterOptionText, activeClass === filter.id && styles.activeFilterText]}>{filterMenuLabel(filter)}</Text>
        </Pressable>)}
      </AnimatedPanel> : null}
      <TactilePressable accessibilityLabel={filtersOpen ? 'Fermer les filtres' : 'Filtrer par classe'} onPress={() => { setFiltersOpen(value => !value); setMenuOpen(false); }} style={styles.filterButton}>
        <Icon kind={filtersOpen ? 'close' : 'filter'} color="#ffffff" />
        {activeClass !== 'ALL' && !filtersOpen ? <View style={styles.filterActiveDot} /> : null}
      </TactilePressable>
    </View> : null}
  </SafeAreaView>;
});

function ProfileMenu({ session, isAdmin, onChildren, onFamilies, onEvents, onResources, onAdmin, onSignOut }: {
  session: Session; isAdmin: boolean; onChildren: () => void; onFamilies: () => void; onEvents: () => void; onResources: () => void; onAdmin: () => void; onSignOut: () => void;
}) {
  return <AnimatedPanel style={styles.profileMenu}>
    <View style={styles.profileHero}>
      <View style={styles.largeAvatar}><Text style={styles.largeAvatarText}>{session.name.trim().charAt(0).toLocaleUpperCase('fr-FR') || 'G'}</Text><View style={styles.cameraBadge}><Icon kind="camera" color="#ffffff" size={15} /></View></View>
      <Text numberOfLines={1} style={styles.profileName}>{session.name}</Text>
      <Text style={styles.profileHint}>Voir mon profil</Text>
    </View>
    <View style={styles.menuGrid}>
      <MenuTile icon="users" label="Familles" onPress={onFamilies} />
      <MenuTile icon="calendar" label="Événements" onPress={onEvents} />
      <MenuTile icon="archive" label="Archives" onPress={onResources} />
      {isAdmin ? <MenuTile icon="sun" label="Administration" onPress={onAdmin} /> : null}
    </View>
    <Pressable accessibilityRole="button" onPress={onChildren} style={styles.directoryLink}><Text style={styles.directoryLinkText}>Annuaire & archives</Text><Text style={styles.menuArrow}>›</Text></Pressable>
    <Pressable accessibilityRole="button" onPress={onSignOut} style={styles.signOutLink}><Text style={styles.signOutText}>Se déconnecter</Text></Pressable>
  </AnimatedPanel>;
}

function MenuTile({ icon, label, onPress }: { icon: IconKind; label: string; onPress: () => void }) {
  return <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={onPress} style={styles.menuTile}>
    <View style={styles.menuTileIcon}><Icon kind={icon} color={PALETTE.icon} size={30} /></View>
    <Text numberOfLines={1} style={styles.menuTileLabel}>{label}</Text>
  </Pressable>;
}

const ChildRow = memo(function ChildRow({ child, color, animateEntrance, entranceDelay, onPress }: { child: Child; color: string; animateEntrance: boolean; entranceDelay: number; onPress: (childId: string) => void }) {
  const photo = child.photoUrl?.trim();
  const [failedPhoto, setFailedPhoto] = useState<string | null>(null);
  const photoFailed = Boolean(photo && failedPhoto === photo);
  const [entrance] = useState(() => new Animated.Value(animateEntrance ? 0 : 1));
  useEffect(() => {
    if (!animateEntrance) return;
    const animation = Animated.timing(entrance, { toValue: 1, duration: 260, delay: entranceDelay, useNativeDriver: true });
    animation.start();
    return () => animation.stop();
  }, [animateEntrance, entrance, entranceDelay]);
  const initials = `${child.firstName.trim().charAt(0)}${(child.lastName || child.postName).trim().charAt(0)}`.toLocaleUpperCase('fr-FR');
  return <Animated.View style={[styles.childEntrance, {
    opacity: entrance,
    transform: [{ translateY: entrance.interpolate({ inputRange: [0, 1], outputRange: [7, 0] }) }],
  }]}>
    <Pressable accessibilityRole="button" accessibilityLabel={`Ouvrir la fiche de ${formatName(child)}`} onPress={() => onPress(child.id)} android_ripple={{ color: '#ffffff12' }} style={styles.childRow}>
      <View style={[styles.childAvatar, { backgroundColor: color }]}>
        {photo && !photoFailed ? <Image alt={`Photo de ${formatName(child)}`} source={{ uri: photo }} resizeMode="cover" style={styles.childPhoto} onError={() => setFailedPhoto(photo)} /> : <Text style={styles.childInitials}>{initials || '•'}</Text>}
      </View>
      <View style={styles.childCopy}>
        <Text numberOfLines={1} style={styles.childName}>{formatName(child)}</Text>
        <Text style={styles.childClass}>{classLabel(child.classLevel)}</Text>
      </View>
    </Pressable>
  </Animated.View>;
});

const CALL_STATUSES: Array<{ id: AttendanceStatus; label: string }> = [
  { id: 'PRESENT', label: 'Présent' }, { id: 'ABSENT', label: 'Absent' }, { id: 'SICK', label: 'Malade' },
];

const CallChildRow = memo(function CallChildRow({ child, color, status, expanded, onToggle, onSetStatus }: {
  child: Child; color: string; status?: AttendanceStatus; expanded: boolean; onToggle: () => void; onSetStatus: (status: AttendanceStatus) => void;
}) {
  const [transition] = useState(() => new Animated.Value(1));
  useEffect(() => {
    transition.setValue(0);
    const animation = Animated.timing(transition, { toValue: 1, duration: 190, useNativeDriver: true });
    animation.start();
    return () => animation.stop();
  }, [expanded, status, transition]);
  const initials = `${child.firstName.trim().charAt(0)}${(child.lastName || child.postName).trim().charAt(0)}`.toLocaleUpperCase('fr-FR');
  return <Animated.View style={[styles.callChildWrap, { opacity: transition, transform: [{ translateY: transition.interpolate({ inputRange: [0, 1], outputRange: [8, 0] }) }] }]}>
    <Pressable accessibilityRole="button" accessibilityLabel={`${formatName(child)}, ${status ? statusLabel(status) : 'non marqué'}. ${expanded ? 'Fermer' : 'Choisir le statut'}`} onPress={onToggle} style={styles.callChildRow}>
      <View style={[styles.childAvatar, styles.callAvatar, { backgroundColor: color }]}><Text style={[styles.childInitials, styles.callInitials]}>{initials || '•'}</Text></View>
      <View style={styles.childCopy}><Text numberOfLines={1} style={styles.childName}>{formatName(child)}</Text><Text style={styles.childClass}>{classLabel(child.classLevel)}</Text></View>
      {status ? <View style={[styles.attendanceBadge, status === 'PRESENT' ? styles.presentBadge : status === 'ABSENT' ? styles.absentBadge : styles.sickBadge]}><Text style={styles.attendanceBadgeText}>{statusLabel(status)}</Text></View> : null}
    </Pressable>
    {expanded ? <View style={styles.statusChoices}>{CALL_STATUSES.map(option => <Pressable key={option.id} accessibilityRole="button" onPress={() => onSetStatus(option.id)} style={[styles.statusChoice, status === option.id && styles.statusChoiceSelected]}><Text style={[styles.statusChoiceText, status === option.id && styles.statusChoiceTextSelected]}>{option.label}</Text></Pressable>)}</View> : null}
  </Animated.View>;
});

function statusLabel(status: AttendanceStatus): string {
  return status === 'PRESENT' ? 'Présent' : status === 'ABSENT' ? 'Absent' : 'Malade';
}

function localDate(value: Date): string {
  return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, '0')}-${String(value.getDate()).padStart(2, '0')}`;
}

function sundayOf(value: Date): string {
  const date = new Date(value.getFullYear(), value.getMonth(), value.getDate());
  date.setDate(date.getDate() - date.getDay());
  return localDate(date);
}

function dateWindow(center: string) {
  return [-2, -1, 0, 1, 2].map(offset => {
    const date = new Date(`${center}T12:00:00`);
    date.setDate(date.getDate() + offset);
    return {
      date: localDate(date),
      number: date.getDate(),
      weekday: new Intl.DateTimeFormat('fr-FR', { weekday: 'short' }).format(date).replace('.', ''),
    };
  });
}

const ActionButton = memo(function ActionButton({ size, label, kind, highlighted = false, onPress }: { size: number; label: string; kind: IconKind; highlighted?: boolean; onPress: () => void }) {
  return <TactilePressable accessibilityLabel={label} onPress={onPress} style={[styles.actionButton, { width: size, height: size, borderRadius: size / 2 }, highlighted && styles.highlightedAction]}>
    <Icon kind={kind} color={highlighted ? '#2e814b' : PALETTE.icon} />
  </TactilePressable>;
});

function TactilePressable({ children, accessibilityLabel, onPress, style }: { children: React.ReactNode; accessibilityLabel: string; onPress: () => void; style: StyleProp<ViewStyle> }) {
  const [scale] = useState(() => new Animated.Value(1));
  const animate = (toValue: number) => Animated.spring(scale, { toValue, useNativeDriver: true, speed: 32, bounciness: 3 }).start();
  return <Animated.View style={{ transform: [{ scale }] }}>
    <Pressable accessibilityRole="button" accessibilityLabel={accessibilityLabel} onPress={onPress} onPressIn={() => animate(0.94)} onPressOut={() => animate(1)} android_ripple={{ color: '#ffffff20' }} style={style}>
      {children}
    </Pressable>
  </Animated.View>;
}

function AnimatedPanel({ children, style }: { children: React.ReactNode; style: StyleProp<ViewStyle> }) {
  const [progress] = useState(() => new Animated.Value(0));
  useEffect(() => {
    const animation = Animated.timing(progress, { toValue: 1, duration: 180, useNativeDriver: true });
    animation.start();
    return () => animation.stop();
  }, [progress]);
  return <Animated.View style={[style, {
    opacity: progress,
    transform: [{ translateY: progress.interpolate({ inputRange: [0, 1], outputRange: [-5, 0] }) }],
  }]}>{children}</Animated.View>;
}

type IconKind = 'check' | 'plus' | 'search' | 'close' | 'bell' | 'filter' | 'speaker' | 'chevron' | 'chevron-up' | 'users' | 'calendar' | 'archive' | 'sun' | 'camera';
const PALETTE = { root: '#0d1410', surface: '#19231d', edge: '#39463e', icon: '#e7ece8', muted: '#a7b2aa', green: '#2e814b' };

const ICON_NAMES: Record<IconKind, LucideIconName> = {
  check: 'check',
  plus: 'plus',
  search: 'search',
  close: 'x',
  bell: 'bell',
  filter: 'list-filter',
  speaker: 'volume-2',
  chevron: 'chevron-down',
  'chevron-up': 'chevron-up',
  users: 'users-round',
  calendar: 'calendar-days',
  archive: 'archive',
  sun: 'sun',
  camera: 'camera',
};

function Icon({ kind, color, size = 24 }: { kind: IconKind; color: string; size?: number }) {
  return <Lucide name={ICON_NAMES[kind]} size={size} color={color} />;
}

function formatName(child: Child): string {
  return [child.firstName, child.lastName, child.postName].map(titleCase).filter(Boolean).join(' ');
}

function titleCase(value: string): string {
  const normalized = value.trim().toLocaleLowerCase('fr-FR');
  return normalized ? normalized.charAt(0).toLocaleUpperCase('fr-FR') + normalized.slice(1) : '';
}

function classLabel(level: ClassLevel): string {
  return level === 'FIRST' ? 'Classe 1' : level === 'SECOND' ? 'Classe 2' : 'Classe 3';
}

function emptyMessage(query: string, activeClass: ClassLevel | 'ALL', activeChildCount: number, online: boolean | null): string {
  if (query.trim()) return 'Aucun enfant ne correspond à cette recherche.';
  if (activeClass !== 'ALL') return 'Aucun enfant enregistré dans cette classe.';
  if (activeChildCount === 0 && online === false) return 'Aucun enfant enregistré sur cet appareil.';
  if (activeChildCount === 0) return 'Aucun enfant enregistré pour le moment.';
  return 'Aucun enfant ne correspond à ces critères.';
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: PALETTE.root },
  listContent: { paddingHorizontal: 20, paddingBottom: 140 },
  callListContent: { paddingHorizontal: 0, paddingBottom: 112 },
  header: { alignItems: 'center', paddingTop: 27, paddingBottom: 4 },
  callHeader: { paddingTop: 34, paddingBottom: 0 },
  callToolbar: { marginTop: 12, marginBottom: 13 },
  brand: { color: '#8d9f93', fontSize: 11, fontWeight: '700', letterSpacing: 1.7 },
  title: { color: '#e9eeea', fontSize: 43, lineHeight: 52, fontWeight: '700', marginTop: 9 },
  subtitle: { color: PALETTE.muted, fontSize: 15, marginTop: 3 },
  toolbar: { alignSelf: 'flex-end', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 22, marginBottom: 13, gap: 10 },
  stickyToolbar: { position: 'absolute', top: 0, left: 0, right: 0, zIndex: 20, paddingHorizontal: 20, paddingVertical: 8, backgroundColor: PALETTE.root, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: PALETTE.edge, elevation: 8 },
  stickyToolbarRow: { marginTop: 0, marginBottom: 0 },
  actionButton: { width: 44, height: 44, borderRadius: 22, backgroundColor: PALETTE.surface, borderColor: PALETTE.edge, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  highlightedAction: { backgroundColor: '#ffffff', borderColor: '#ffffff' },
  badge: { position: 'absolute', top: -4, right: -2, minWidth: 20, height: 20, paddingHorizontal: 4, borderRadius: 10, backgroundColor: '#e6372c', alignItems: 'center', justifyContent: 'center' },
  badgeText: { color: '#fff', fontSize: 10, fontWeight: '800' },
  profileButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-around', paddingHorizontal: 4, backgroundColor: PALETTE.surface, borderWidth: 1, borderColor: PALETTE.edge },
  profileButtonOpen: { backgroundColor: '#e7ece8', borderColor: '#e7ece8' },
  profileAvatar: { alignItems: 'center', justifyContent: 'center', backgroundColor: '#193b27' },
  profileText: { color: '#95d2a8', fontSize: 17, fontWeight: '700' },
  connection: { minHeight: 18, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginTop: 0, marginBottom: 4 },
  connectionDot: { width: 6, height: 6, borderRadius: 3, marginRight: 6 },
  onlineDot: { backgroundColor: '#5fc47d' },
  offlineDot: { backgroundColor: '#e5ab47' },
  syncDot: { backgroundColor: '#71a9ee' },
  connectionText: { color: '#87958b', fontSize: 10 },
  syncError: { alignSelf: 'stretch', marginTop: 3, color: '#ef9b91', textAlign: 'center', fontSize: 10 },
  searchPanel: { alignSelf: 'stretch', marginTop: 0, marginBottom: 6 },
  searchRow: { minHeight: 48, flexDirection: 'row', alignItems: 'center', borderRadius: 28, backgroundColor: PALETTE.surface, paddingHorizontal: 8, overflow: 'hidden' },
  searchIcon: { width: 40, alignItems: 'center', justifyContent: 'center' },
  searchInput: { flex: 1, height: 48, paddingLeft: 0, paddingRight: 8, color: PALETTE.icon, fontSize: 18 },
  clearSearch: { width: 36, height: 36, borderRadius: 18, borderWidth: 1, borderColor: '#4b5750', backgroundColor: '#26332b', alignItems: 'center', justifyContent: 'center' },
  menuArrow: { color: PALETTE.muted, fontSize: 21 },
  profileMenu: { width: '100%', alignItems: 'center', paddingTop: 20, paddingBottom: 24 },
  profileHero: { alignItems: 'center', width: '100%' },
  largeAvatar: { width: 104, height: 104, borderRadius: 52, alignItems: 'center', justifyContent: 'center', backgroundColor: '#193b27' },
  largeAvatarText: { color: '#95d2a8', fontSize: 40, fontWeight: '500' },
  cameraBadge: { position: 'absolute', right: 1, bottom: 3, width: 29, height: 29, borderRadius: 15, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: PALETTE.root, backgroundColor: PALETTE.green },
  profileName: { maxWidth: '100%', color: PALETTE.icon, fontSize: 24, lineHeight: 30, fontWeight: '700', marginTop: 10 },
  profileHint: { color: PALETTE.muted, fontSize: 14, marginTop: 7 },
  menuGrid: { width: '100%', flexDirection: 'row', flexWrap: 'wrap', marginTop: 28, rowGap: 24 },
  menuTile: { width: '50%', minHeight: 116, alignItems: 'center', justifyContent: 'flex-start' },
  menuTileIcon: { width: 76, height: 76, borderRadius: 38, alignItems: 'center', justifyContent: 'center', backgroundColor: PALETTE.surface },
  menuTileLabel: { maxWidth: '100%', color: PALETTE.icon, fontSize: 20, lineHeight: 25, fontWeight: '700', marginTop: 12 },
  directoryLink: { width: '100%', minHeight: 44, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 160, paddingHorizontal: 12, borderTopWidth: StyleSheet.hairlineWidth, borderColor: PALETTE.edge },
  directoryLinkText: { color: PALETTE.muted, fontSize: 13, fontWeight: '600' },
  signOutLink: { alignSelf: 'center', padding: 10, marginTop: 6 },
  signOutText: { color: '#87958b', fontSize: 12, fontWeight: '600' },
  resultMeta: { alignSelf: 'stretch', flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-start', minHeight: 27, marginTop: 6, marginBottom: 3 },
  resultCount: { color: PALETTE.muted, fontSize: 13, fontWeight: '500' },
  childEntrance: { alignSelf: 'stretch' },
  childRow: { minHeight: 64, flexDirection: 'row', alignItems: 'center', paddingVertical: 6 },
  childAvatar: { width: 52, height: 52, borderRadius: 26, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  childPhoto: { width: '100%', height: '100%', borderRadius: 26 },
  childInitials: { color: '#17221b', fontSize: 17, fontWeight: '700' },
  childCopy: { flex: 1, marginLeft: 16 },
  childName: { color: '#e6ebe7', fontSize: 17, fontWeight: '500' },
  childClass: { color: PALETTE.muted, fontSize: 13, marginTop: 2 },
  dateStrip: { alignSelf: 'stretch', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 12, marginBottom: 0, gap: 8 },
  dateTile: { flex: 1, minHeight: 80, borderRadius: 42, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: PALETTE.edge, backgroundColor: PALETTE.surface },
  dateTileActive: { flex: 1.2, minHeight: 100, backgroundColor: '#a8e8bd', borderColor: '#a8e8bd' },
  dateNumber: { color: PALETTE.muted, fontSize: 22, fontWeight: '700' },
  dateNumberActive: { color: '#0d1410', fontSize: 27 },
  dateWeekday: { color: PALETTE.muted, fontSize: 13, marginTop: 2, textTransform: 'capitalize' },
  dateWeekdayActive: { color: '#0d1410', fontSize: 15 },
  futureDateTile: { opacity: 0.35 },
  callChildWrap: { alignSelf: 'stretch', paddingHorizontal: 20, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#26332b' },
  callChildRow: { minHeight: 82, flexDirection: 'row', alignItems: 'center', paddingVertical: 7 },
  callAvatar: { width: 40, height: 40, borderRadius: 20 },
  callInitials: { fontSize: 14 },
  attendanceBadge: { minWidth: 72, paddingHorizontal: 12, paddingVertical: 6, alignItems: 'center', borderRadius: 22, borderWidth: 1 },
  presentBadge: { backgroundColor: '#1c5635', borderColor: '#3d8055' },
  absentBadge: { backgroundColor: '#582b2a', borderColor: '#854746' },
  sickBadge: { backgroundColor: '#5a4720', borderColor: '#897133' },
  attendanceBadgeText: { color: '#b3ebc6', fontSize: 13, fontWeight: '700' },
  statusChoices: { flexDirection: 'row', gap: 8, paddingBottom: 11 },
  statusChoice: { flex: 1, minHeight: 36, alignItems: 'center', justifyContent: 'center', borderRadius: 23, backgroundColor: PALETTE.surface, borderWidth: 1, borderColor: PALETTE.edge },
  statusChoiceSelected: { backgroundColor: PALETTE.green, borderColor: '#4c9a67' },
  statusChoiceText: { color: '#c3ccc6', fontSize: 13, fontWeight: '600' },
  statusChoiceTextSelected: { color: '#ffffff' },
  callFooter: { position: 'absolute', left: 0, right: 0, bottom: 0, paddingHorizontal: 20, paddingTop: 12, paddingBottom: 6, backgroundColor: PALETTE.root },
  finishCallButton: { minHeight: 56, alignItems: 'center', justifyContent: 'center', borderRadius: 40, borderWidth: 1, borderColor: '#4c9a67', backgroundColor: PALETTE.green },
  finishCallText: { color: '#ffffff', fontSize: 18, fontWeight: '800' },
  emptyText: { color: PALETTE.muted, fontSize: 14, textAlign: 'center', paddingVertical: 30 },
  filterScrim: { ...StyleSheet.absoluteFill, zIndex: 30, backgroundColor: 'rgba(0, 0, 0, 0.58)' },
  floatingWrap: { position: 'absolute', right: 20, bottom: 22, alignItems: 'flex-end', zIndex: 31 },
  filterButton: { width: 59, height: 59, borderRadius: 30, backgroundColor: PALETTE.green, borderWidth: 1, borderColor: '#4c9a67', alignItems: 'center', justifyContent: 'center', elevation: 5 },
  filterActiveDot: { position: 'absolute', top: 2, right: 2, width: 13, height: 13, borderRadius: 7, backgroundColor: '#f2c84b', borderWidth: 2, borderColor: PALETTE.green },
  filterMenu: { alignItems: 'flex-end', marginBottom: 12, gap: 10 },
  filterOption: { width: 105, minHeight: 48, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 10, borderRadius: 26, backgroundColor: '#202b24', borderWidth: 1, borderColor: PALETTE.edge, elevation: 5 },
  activeFilterOption: { backgroundColor: PALETTE.green, borderColor: '#4c9a67' },
  filterOptionText: { color: PALETTE.icon, fontSize: 16, fontWeight: '600' },
  activeFilterText: { color: '#fff' },
});
