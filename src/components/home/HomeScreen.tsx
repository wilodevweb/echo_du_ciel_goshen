"use client";

import Image from "next/image";
import Link from "next/link";
import { signOut } from "next-auth/react";
import { useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
import { clearCachedUser } from "@/hooks/useAuthUser";
import { useLiveQuery } from "dexie-react-hooks";
import {
  Bell,
  Archive,
  Camera,
  ChevronDown,
  ListFilter,
  Plus,
  Search,
  Sun,
  Users,
  X,
  CalendarDays,
  Volume2,
} from "lucide-react";
import db, { generateId, getAttendanceStatus, markEntityForSync, type AttendanceStatus, type Child, type ClassFilter, type ClassLevel } from "@/lib/db";
import { buildNotificationSections, countNotifiedChildren } from "../../../android-app/src/notifications";
import type { Attendance as MobileAttendance, Child as MobileChild } from "../../../android-app/src/types";

const FILTERS: Array<{ id: ClassFilter; label: string }> = [
  { id: "ALL", label: "Toutes les classes" },
  { id: "FIRST", label: "Classe 1" },
  { id: "SECOND", label: "Classe 2" },
  { id: "THIRD", label: "Classe 3" },
];
const AVATAR_COLORS = ["#f58a37", "#58b776", "#f7c52f", "#ed6960", "#69a0ee"];

interface HomeScreenProps {
  name: string;
  isAdmin: boolean;
}

export function HomeScreen({ name, isAdmin }: HomeScreenProps) {
  const allChildren = useLiveQuery(() => db.children.toArray(), []);
  const [searchOpen, setSearchOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [activeClass, setActiveClass] = useState<ClassFilter>("ALL");
  const [query, setQuery] = useState("");
  const [attendanceMode, setAttendanceMode] = useState(false);
  const [attendanceDate, setAttendanceDate] = useState(() => recentSunday());
  const attendanceSnapshot = useLiveQuery(
    async () => ({ date: attendanceDate, records: await db.attendances.where("date").equals(attendanceDate).toArray() }),
    [attendanceDate],
  );
  const attendancesForDate = attendanceSnapshot?.date === attendanceDate ? attendanceSnapshot.records : undefined;
  const recentAttendanceSince = useLiveQuery(async () => {
    const since = new Date();
    // Les trois absences consécutives peuvent couvrir jusqu'à 28 jours.
    since.setDate(since.getDate() - 28);
    const minDate = `${since.getFullYear()}-${String(since.getMonth() + 1).padStart(2, "0")}-${String(since.getDate()).padStart(2, "0")}`;
    return db.attendances.where("date").aboveOrEqual(minDate).toArray();
  }, []);
  const [expandedAttendanceChild, setExpandedAttendanceChild] = useState<string | null>(null);
  const callDateStripRef = useRef<HTMLDivElement>(null);
  const deferredQuery = useDeferredValue(query.trim().toLocaleLowerCase("fr-FR"));
  const children = useMemo(() => (allChildren ?? [])
    .filter((child) => !child.notes?.includes("[ARCHIVE]") && hasChildName(child))
    .sort((a, b) => childName(a).localeCompare(childName(b), "fr-FR")), [allChildren]);
  const visibleChildren = useMemo(() => children.filter((child) => {
    if (activeClass !== "ALL" && child.classLevel !== activeClass) return false;
    if (!deferredQuery) return true;
    return [childName(child), child.parentName ?? "", child.parentPhone]
      .some((value) => value.toLocaleLowerCase("fr-FR").includes(deferredQuery));
  }), [activeClass, children, deferredQuery]);
  const activeFilter = FILTERS.find((filter) => filter.id === activeClass)?.label ?? FILTERS[0].label;
  const attendanceByChild = useMemo(() => new Map((attendancesForDate ?? []).map(item => [item.childId, getAttendanceStatus(item)])), [attendancesForDate]);
  const markedCount = useMemo(() => visibleChildren.filter(child => attendanceByChild.get(child.id)).length, [attendanceByChild, visibleChildren]);
  const nextUnmarkedChild = (_date: string, afterChildId?: string) => {
    const markedIds = new Set((attendancesForDate ?? []).map(item => item.childId));
    if (afterChildId) markedIds.add(afterChildId);
    const startIndex = afterChildId ? children.findIndex(child => child.id === afterChildId) + 1 : 0;
    return children.slice(Math.max(0, startIndex)).find(child => !markedIds.has(child.id))?.id ?? null;
  };
  useEffect(() => {
    if (attendanceMode && expandedAttendanceChild === null && attendanceSnapshot?.date === attendanceDate) {
      setExpandedAttendanceChild(nextUnmarkedChild(attendanceDate));
    }
  }, [attendanceDate, attendanceMode, attendanceSnapshot, expandedAttendanceChild]);
  const scrollToCallChild = (childId: string | null) => {
    if (!childId) return;
    requestAnimationFrame(() => document.getElementById(`call-child-${childId}`)?.scrollIntoView({ behavior: "smooth", block: "center" }));
  };
  const saveAttendance = async (childId: string, status: AttendanceStatus) => {
    const current = await db.attendances.where({ childId, date: attendanceDate }).first();
    const previousMarkedAt = Date.parse(current?.markedAt ?? "");
    const payload = { present: status === "PRESENT", status, markedAt: new Date(Math.max(Date.now(), Number.isFinite(previousMarkedAt) ? previousMarkedAt + 1 : 0)).toISOString() };
    let id = current?.id;
    if (id) await db.attendances.update(id, payload);
    else {
      id = generateId();
      await db.attendances.add({ id, childId, date: attendanceDate, ...payload });
    }
    await markEntityForSync("attendance", id);
  };
  const alertsCount = useMemo(() => {
    if (!allChildren || !recentAttendanceSince) return 0;
    const mobileChildren = allChildren as unknown as MobileChild[];
    const mobileAttendance = recentAttendanceSince.map((attendance) => ({
      ...attendance,
      status: getAttendanceStatus(attendance) ?? "ABSENT",
    })) as unknown as MobileAttendance[];
    return countNotifiedChildren(buildNotificationSections(mobileChildren, mobileAttendance));
  }, [allChildren, recentAttendanceSince]);
  useEffect(() => {
    if (!attendanceMode || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const animation = callDateStripRef.current?.animate(
      [{ opacity: 0.55, transform: "translateY(-7px) scale(0.99)" }, { opacity: 1, transform: "translateY(0) scale(1)" }],
      { duration: 240, easing: "cubic-bezier(0.22, 1, 0.36, 1)" },
    );
    return () => animation?.cancel();
  }, [attendanceDate, attendanceMode]);

  return (
      <main className="min-h-dvh bg-[#0d1410] px-5 pb-28 text-[#e7ece8]">
      <div className="mx-auto w-full max-w-3xl">
        <header className="flex flex-col items-center pt-[max(58px,calc(env(safe-area-inset-top,0px)+27px))] text-center">
          <p className="text-[11px] font-bold tracking-[0.17em] text-[#8d9f93]">ÉCHO DU CIEL · GOSHEN</p>
          {attendanceMode ? <DateStrip animationRef={callDateStripRef} value={attendanceDate} onChange={value => { window.scrollTo({ top: 0, behavior: "smooth" }); setExpandedAttendanceChild(null); setAttendanceDate(value); }} /> : <>
          <h1 className="mt-[9px] text-[43px] font-bold leading-[52px] text-[#e9eeea]">{menuOpen ? "Menu" : "Enfants"}</h1>
          <p className="mt-1 text-[15px] text-[#a7b2aa]">
            {menuOpen ? "Mon espace" : searchOpen && activeClass === "ALL" ? "École du Dimanche" : activeClass === "ALL" ? `${children.length} ${children.length === 1 ? "enfant" : "enfants"} · École du Dimanche` : `Filtre actif : ${activeFilter}`}
          </p>
          </>}
        </header>

        <nav aria-label="Actions principales" className="sticky top-0 z-20 -mx-5 mt-2 mb-3 flex h-11 w-[calc(100%+40px)] items-center justify-end bg-[#0d1410]/95 px-5 backdrop-blur">
          <div className="flex h-11 w-[292px] max-w-full items-center justify-between gap-2.5">
          <button type="button" aria-label={attendanceMode ? "Appel en cours" : "Faire l’appel"} title="Faire l’appel" onClick={() => { if (!attendanceMode) { setSearchOpen(false); setMenuOpen(false); setFiltersOpen(false); setActiveClass("ALL"); setQuery(""); window.scrollTo({ top: 0, behavior: "smooth" }); const callDate = recentSunday(); setAttendanceDate(callDate); setExpandedAttendanceChild(null); setAttendanceMode(true); } }} className={`home-action ${attendanceMode ? "!border-white !bg-white !text-[#2e814b]" : ""}`}><Volume2 /></button>
          <ActionLink href="/enfants/nouveau" label="Ajouter un enfant"><Plus /></ActionLink>
          <button type="button" aria-label={searchOpen ? "Fermer la recherche" : "Rechercher"} onClick={() => { if (searchOpen) setQuery(""); setSearchOpen((open) => !open); setMenuOpen(false); }} className="home-action">
            <Search />
          </button>
          <Link href="/notifications" aria-label={`${alertsCount} notifications`} title="Notifications" className="home-action relative">
            <Bell />
            {alertsCount > 0 && <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-[#e6372c] px-1 text-[10px] font-extrabold text-white">{alertsCount > 99 ? "99+" : alertsCount}</span>}
          </Link>
          <button type="button" aria-expanded={menuOpen} aria-label={menuOpen ? "Fermer le menu du profil" : "Ouvrir le menu du profil"} onClick={() => { setMenuOpen((open) => !open); setSearchOpen(false); setFiltersOpen(false); }} className={`flex h-11 w-[76px] shrink-0 items-center justify-around rounded-full border px-1 transition-colors ${menuOpen ? "border-[#e7ece8] bg-[#e7ece8] text-[#0d1410]" : "border-[#39463e] bg-[#19231d] text-[#e7ece8] hover:bg-[#202b24]"}`}>
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[#193b27] font-bold text-[#95d2a8]">{name.trim().charAt(0).toLocaleUpperCase("fr-FR") || "G"}</span>
            <ChevronDown className={`mr-1 h-4 w-4 transition-transform ${menuOpen ? "rotate-180" : ""}`} />
          </button>
          </div>
        </nav>

        {menuOpen ? <ProfileMenu name={name} isAdmin={isAdmin} onSignOut={() => { clearCachedUser(); void signOut({ callbackUrl: "/login" }); }} /> : <>
        {searchOpen && <div className="mt-4 flex h-12 items-center gap-3 rounded-full bg-[#19231d] px-2">
          <Search aria-hidden="true" className="ml-2 h-6 w-6 shrink-0 text-[#e7ece8]" />
          <input autoFocus value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Rechercher un enfant ou un parent" aria-label="Rechercher un enfant ou un parent" className="h-full min-w-0 flex-1 bg-transparent text-lg text-[#e7ece8] outline-none placeholder:text-[#87958b]" />
          <button type="button" aria-label={query ? "Effacer la recherche" : "Fermer la recherche"} onClick={() => { if (query) setQuery(""); else setSearchOpen(false); }} className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-[#4b5750] bg-[#26332b] text-[#e7ece8]"><X className="h-5 w-5" /></button>
        </div>}

        {searchOpen && <p aria-live="polite" className="mt-3 text-left text-[13px] font-medium text-[#a7b2aa]">{query.trim() ? `${visibleChildren.length} ${visibleChildren.length === 1 ? "résultat" : "résultats"} pour « ${query.trim()} »` : `${visibleChildren.length} ${visibleChildren.length === 1 ? "enfant trouvé" : "enfants trouvés"}`}</p>}

        {allChildren === undefined ? <p className="py-12 text-center text-sm text-[#a7b2aa]">Chargement des enfants…</p> : visibleChildren.length === 0 ? (
          <div className="py-12 text-center text-sm text-[#a7b2aa]">
            {deferredQuery ? "Aucun enfant ne correspond à cette recherche." : activeClass !== "ALL" ? "Aucun enfant enregistré dans cette classe." : children.length ? "Aucun enfant ne correspond à ces critères." : "Aucun enfant enregistré pour le moment."}
            {!children.length && <p className="mt-3"><Link href="/enfants/nouveau" className="font-semibold text-[#95d2a8] hover:underline">Ajouter le premier enfant</Link></p>}
          </div>
        ) : <ul>
          {visibleChildren.map((child, index) => <li key={child.id}>
            {attendanceMode ? <CallChildRow child={child} index={index} status={attendanceByChild.get(child.id)} expanded={expandedAttendanceChild === child.id}
              onToggle={() => setExpandedAttendanceChild(current => current === child.id ? null : child.id)}
              onSetStatus={status => { void saveAttendance(child.id, status); const nextChild = nextUnmarkedChild(attendanceDate, child.id); setExpandedAttendanceChild(nextChild); scrollToCallChild(nextChild); }} /> :
            <Link href={`/enfants?selectedChildId=${encodeURIComponent(child.id)}`} className="flex min-h-16 items-center gap-4 py-1.5 transition-colors hover:bg-white/[0.03]">
              <ChildAvatar child={child} index={index} />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[17px] font-medium text-[#e6ebe7]">{childName(child)}</span>
                <span className="mt-0.5 block text-[13px] text-[#a7b2aa]">{classLabel(child.classLevel)}</span>
              </span>
            </Link>
            }
          </li>)}
        </ul>}
        </>}
      </div>

      {!attendanceMode && filtersOpen && <button type="button" aria-label="Fermer les filtres" onClick={() => setFiltersOpen(false)} className="fixed inset-0 z-30 cursor-default bg-black/60" />}
      {!attendanceMode && !menuOpen && <div className="fixed bottom-8 right-5 z-40 flex flex-col items-end sm:right-[max(2rem,calc((100vw-48rem)/2))]">
        {filtersOpen && <div role="group" aria-label="Filtrer par classe" className="mb-3 flex flex-col items-end gap-2.5">
          {FILTERS.map((filter) => <button type="button" key={filter.id} aria-pressed={activeClass === filter.id} onClick={() => { setActiveClass(filter.id); setFiltersOpen(false); }} className={`flex min-h-12 w-[105px] items-center justify-center rounded-full border px-2.5 text-base font-semibold shadow-lg transition-colors ${activeClass === filter.id ? "border-[#4c9a67] bg-[#2e814b] text-white" : "border-[#39463e] bg-[#202b24] text-[#e7ece8] hover:bg-[#26352b]"}`}>
            {filter.id === "ALL" ? "Tous" : filter.label}
          </button>)}
        </div>}
        <button type="button" aria-label={filtersOpen ? "Fermer les filtres" : "Filtrer par classe"} aria-expanded={filtersOpen} onClick={() => { setFiltersOpen((open) => !open); setMenuOpen(false); }} className="relative flex h-[59px] w-[59px] items-center justify-center rounded-full border border-[#4c9a67] bg-[#2e814b] text-white shadow-lg transition-transform active:scale-95">{filtersOpen ? <X className="h-6 w-6" /> : <ListFilter className="h-6 w-6" />}{activeClass !== "ALL" && !filtersOpen && <span className="absolute right-0 top-0 h-3 w-3 rounded-full border-2 border-[#2e814b] bg-[#f2c84b]" />}</button>
      </div>
      }
      {attendanceMode && <div className="fixed inset-x-0 bottom-0 z-30 bg-[#0d1410] px-5 pt-3 pb-[max(18px,env(safe-area-inset-bottom))]">
        <button type="button" onClick={() => { setAttendanceMode(false); setExpandedAttendanceChild(null); }} className="mx-auto flex min-h-[72px] w-full max-w-3xl items-center justify-center rounded-full border border-[#4c9a67] bg-[#2e814b] text-[20px] font-bold text-white">Terminer l’appel · {markedCount}/{visibleChildren.length}</button>
      </div>}
    </main>
  );
}

const CALL_STATUSES: Array<{ id: AttendanceStatus; label: string }> = [
  { id: "PRESENT", label: "Présent" }, { id: "ABSENT", label: "Absent" }, { id: "SICK", label: "Malade" },
];

function CallChildRow({ child, index, status, expanded, onToggle, onSetStatus }: {
  child: Child; index: number; status: AttendanceStatus | null | undefined; expanded: boolean; onToggle: () => void; onSetStatus: (status: AttendanceStatus) => void;
}) {
  const rowRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const animation = rowRef.current?.animate(
      [{ opacity: 0.5, transform: "translateY(8px)" }, { opacity: 1, transform: "translateY(0)" }],
      { duration: 190, easing: "cubic-bezier(0.22, 1, 0.36, 1)" },
    );
    return () => animation?.cancel();
  }, [expanded, status]);
  return <div id={`call-child-${child.id}`} ref={rowRef} className="border-b border-[#26332b]">
    <button type="button" aria-expanded={expanded} onClick={onToggle} className="flex min-h-[82px] w-full items-center gap-4 py-2 text-left">
      <ChildAvatar child={child} index={index} />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[17px] font-medium text-[#e6ebe7]">{childName(child)}</span>
        <span className="mt-0.5 block text-[13px] text-[#a7b2aa]">{classLabel(child.classLevel)}</span>
      </span>
      {status && <span className={`min-w-[78px] rounded-full border px-3.5 py-2 text-center text-sm font-semibold ${status === "PRESENT" ? "border-[#3d8055] bg-[#1c5635] text-[#b3ebc6]" : status === "ABSENT" ? "border-[#854746] bg-[#582b2a] text-[#ffb6ae]" : "border-[#897133] bg-[#5a4720] text-[#f1d88b]"}`}>{status === "PRESENT" ? "Présent" : status === "ABSENT" ? "Absent" : "Malade"}</span>}
    </button>
    {expanded && <div className="flex gap-2 pb-3">
      {CALL_STATUSES.map(option => <button type="button" key={option.id} onClick={() => onSetStatus(option.id)} className={`min-h-10 flex-1 rounded-full border text-sm font-semibold ${status === option.id ? "border-[#4c9a67] bg-[#2e814b] text-white" : "border-[#39463e] bg-[#19231d] text-[#c3ccc6]"}`}>{option.label}</button>)}
    </div>}
  </div>;
}

function DateStrip({ value, onChange, animationRef }: { value: string; onChange: (value: string) => void; animationRef: React.RefObject<HTMLDivElement | null> }) {
  const dates = [-2, -1, 0, 1, 2].map(offset => {
    const date = new Date(`${value}T12:00:00`);
    date.setDate(date.getDate() + offset);
    const formatted = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
    return { value: formatted, day: date.getDate(), weekday: new Intl.DateTimeFormat("fr-FR", { weekday: "short" }).format(date).replace(".", "") };
  });
  const today = localDate(new Date());
  return <div ref={animationRef} className="mt-5 flex w-full items-center justify-between gap-2" aria-label="Choisir le jour de l’appel">
    {dates.map(day => <button type="button" key={day.value} disabled={day.value > today} aria-pressed={day.value === value} onClick={() => onChange(day.value)} className={`flex min-h-[80px] flex-1 flex-col items-center justify-center rounded-full border ${day.value === value ? "min-h-[100px] border-[#a8e8bd] bg-[#a8e8bd] text-[#0d1410]" : "border-[#39463e] bg-[#19231d] text-[#a7b2aa]"} disabled:opacity-35`}>
      <span className={`text-[22px] font-bold ${day.value === value ? "text-[27px]" : ""}`}>{day.day}</span><span className="mt-0.5 text-sm capitalize">{day.weekday}</span>
    </button>)}
  </div>;
}

function localDate(value: Date) {
  return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, "0")}-${String(value.getDate()).padStart(2, "0")}`;
}

function recentSunday(value = new Date()) {
  const date = new Date(value.getFullYear(), value.getMonth(), value.getDate());
  date.setDate(date.getDate() - date.getDay());
  return localDate(date);
}

function ActionLink({ href, label, children }: { href: string; label: string; children: React.ReactNode }) {
  return <Link href={href} aria-label={label} title={label} className="home-action">{children}</Link>;
}

function ProfileMenu({ name, isAdmin, onSignOut }: { name: string; isAdmin: boolean; onSignOut: () => void }) {
  const tiles = [
    { href: "/famille", label: "Familles", icon: Users },
    { href: "/evenements", label: "Événements", icon: CalendarDays },
    { href: "/fichiers", label: "Archives", icon: Archive },
    ...(isAdmin ? [{ href: "/dashboard", label: "Administration", icon: Sun }] : []),
  ];
  return <section aria-label="Menu principal" className="attendance-sheet-in mx-auto mt-5 w-full max-w-xl pb-6 text-center">
    <div className="flex flex-col items-center">
      <div className="relative flex h-[104px] w-[104px] items-center justify-center rounded-full bg-[#193b27] text-[40px] font-medium text-[#95d2a8]">
        {name.trim().charAt(0).toLocaleUpperCase("fr-FR") || "G"}
        <span aria-hidden="true" className="absolute -bottom-0.5 -right-0.5 flex h-[29px] w-[29px] items-center justify-center rounded-full border-2 border-[#0d1410] bg-[#2e814b] text-white"><Camera className="h-[15px] w-[15px]" /></span>
      </div>
      <h2 className="mt-2.5 max-w-full truncate text-2xl font-bold leading-[30px]">{name}</h2>
      <p className="mt-1.5 text-sm text-[#a7b2aa]">Voir mon profil</p>
    </div>
    <div className="mt-7 grid grid-cols-2 gap-y-8">
      {tiles.map(({ href, label, icon: Icon }) => <Link key={href} href={href} className="flex min-h-[116px] flex-col items-center">
        <span className="flex h-[76px] w-[76px] items-center justify-center rounded-full bg-[#19231d] text-[#e7ece8] transition-colors hover:bg-[#202b24]"><Icon className="h-[30px] w-[30px]" /></span>
        <span className="mt-3 max-w-full truncate text-xl font-bold leading-[25px]">{label}</span>
      </Link>)}
    </div>
    <Link href="/enfants" className="mt-40 flex min-h-11 items-center justify-between border-t border-[#39463e] px-3 text-left text-[13px] font-semibold text-[#a7b2aa]">Annuaire & archives<span className="text-xl">›</span></Link>
    <button type="button" onClick={onSignOut} className="mt-2 p-2 text-xs font-semibold text-[#87958b]">Se déconnecter</button>
  </section>;
}

function ChildAvatar({ child, index }: { child: Child; index: number }) {
  const [photoFailed, setPhotoFailed] = useState(false);
  const color = AVATAR_COLORS[index % AVATAR_COLORS.length];
  const initials = `${child.firstName.trim().charAt(0)}${(child.lastName || child.postName).trim().charAt(0)}`.toLocaleUpperCase("fr-FR");
  return <span className="relative flex h-[52px] w-[52px] shrink-0 items-center justify-center overflow-hidden rounded-full text-[17px] font-bold text-[#17221b]" style={{ backgroundColor: color }}>
    {child.photoUrl && !photoFailed ? <Image src={child.photoUrl} alt="" fill sizes="52px" unoptimized className="object-cover" onError={() => setPhotoFailed(true)} /> : initials || "•"}
  </span>;
}

function hasChildName(child: Child) {
  return Boolean(child.firstName.trim() || child.lastName.trim() || child.postName.trim());
}

function childName(child: Child) {
  return [child.firstName, child.lastName, child.postName].map(titleCase).filter(Boolean).join(" ");
}

function titleCase(value: string) {
  const normalized = value.trim().toLocaleLowerCase("fr-FR");
  return normalized ? normalized.charAt(0).toLocaleUpperCase("fr-FR") + normalized.slice(1) : "";
}

function classLabel(level: ClassLevel) {
  return level === "FIRST" ? "Classe 1" : level === "SECOND" ? "Classe 2" : "Classe 3";
}
