import Dexie, { type EntityTable } from 'dexie';

export interface Child {
  id: string; // Changed to string for UUID/CUID compatibility with Prisma
  firstName: string;
  lastName: string;
  photoUrl?: string;
  parentPhone: string;
  address: string;
  birthDate?: string;
  notes?: string;
  createdAt: string;
}

export interface Attendance {
  id: string; // Changed to string
  childId: string; // References Child.id
  date: string; // Format: YYYY-MM-DD
  present: boolean;
  markedAt: string;
}

// Générateur basique d'ID unique (fallback simple pour mode hors-ligne)
export const generateId = () => Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);

const db = new Dexie('SundaySchoolDB') as Dexie & {
  children: EntityTable<Child, 'id'>;
  attendances: EntityTable<Attendance, 'id'>;
};

// Schéma de la base de données (id is no longer auto-incremented `++id`, we set it manually)
db.version(2).stores({
  children: 'id, firstName, lastName, parentPhone',
  attendances: 'id, childId, date, [childId+date]'
});

// Fonction de synchronisation avec le serveur
export async function syncWithServer() {
  try {
    const children = await db.children.toArray();
    const attendances = await db.attendances.toArray();

    const response = await fetch('/api/sync', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ children, attendances }),
    });

    if (response.ok) {
      console.log('Synchronisation réussie !');
      return true;
    } else {
      console.error('Échec de la synchronisation');
      return false;
    }
  } catch (error) {
    console.error('Erreur réseau lors de la synchronisation:', error);
    return false;
  }
}

export default db;
