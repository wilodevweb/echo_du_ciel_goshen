import React from "react";
import { useLiveQuery } from "dexie-react-hooks";
import db, { type Child, getClassLabel } from "@/lib/db";
import { User, Loader2 } from "lucide-react";

interface SiblingsListProps {
  currentChildId: string;
  parentId?: string;
}

export function SiblingsList({ currentChildId, parentId }: SiblingsListProps) {
  const siblings = useLiveQuery(async () => {
    if (!parentId) return null;

    let potentialSiblings: Child[] = [];
    
    if (parentId) {
      potentialSiblings = await db.children.where('parentId').equals(parentId).toArray();
    }
    
    return potentialSiblings.filter(c => c.id !== currentChildId);
  }, [currentChildId, parentId]);

  if (siblings === undefined) {
    return (
      <div className="flex justify-center p-6">
        <Loader2 className="w-6 h-6 animate-spin text-white/50" />
      </div>
    );
  }

  if (siblings === null) {
    return (
      <div className="text-center p-6 border border-white/10 rounded-2xl bg-white/5 mt-4">
        <p className="text-sm text-white/50 font-medium">
          Veuillez assigner un parent pour voir les frères et sœurs.
        </p>
      </div>
    );
  }

  if (siblings.length === 0) {
    return (
      <div className="text-center p-6 border border-white/10 rounded-2xl bg-white/5 mt-4">
        <p className="text-sm text-white/50 font-medium">
          Aucun autre enfant trouvé pour ce parent.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3 mt-4">
      {siblings.map((sibling) => (
        <div 
          key={sibling.id} 
          className="flex items-center gap-4 p-3 rounded-2xl bg-white/5 border border-white/10"
        >
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-white/10 text-white/85 overflow-hidden">
            {sibling.photoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={sibling.photoUrl} alt="Photo" className="w-full h-full object-cover" />
            ) : (
              <User className="h-6 w-6" />
            )}
          </div>
          <div className="min-w-0 flex-1 text-left">
            <p className="text-base font-semibold leading-tight text-white truncate">
              {sibling.firstName} {sibling.lastName}
            </p>
            <div className="flex items-center gap-2 mt-1">
              <span className="text-xs font-medium text-white/55">
                {getClassLabel(sibling.classLevel)}
              </span>
              <span className="text-[10px] bg-white/10 px-2 py-0.5 rounded-full text-white/70">
                {sibling.gender === 'M' ? 'Garçon' : 'Fille'}
              </span>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
