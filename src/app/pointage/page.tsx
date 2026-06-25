"use client";

import React, { useMemo, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useLiveQuery } from 'dexie-react-hooks';
import { ArrowLeft, CheckCircle2, Circle, User } from 'lucide-react';
import db from '@/lib/db';
import { Card, CardContent } from '@/components/ui/Card';

export default function PointagePage() {
  // Format date to YYYY-MM-DD for input default
  const getTodayStr = () => new Date().toISOString().split('T')[0];
  const [selectedDate, setSelectedDate] = useState(getTodayStr());

  // Récupérer tous les enfants
  const children = useLiveQuery(() => db.children.orderBy('firstName').toArray());
  
  // Récupérer les présences pour la date sélectionnée
  const attendances = useLiveQuery(
    () => db.attendances.where('date').equals(selectedDate).toArray(),
    [selectedDate]
  );

  // Map des présences (childId -> boolean)
  const attendanceMap = useMemo(() => {
    const map = new Map<string, boolean>();
    attendances?.forEach(att => {
      map.set(att.childId, att.present);
    });
    return map;
  }, [attendances]);

  const toggleAttendance = async (childId: string) => {
    const isPresent = attendanceMap.get(childId) || false;
    
    const existingRecord = await db.attendances
      .where({ childId: childId, date: selectedDate })
      .first();

    if (existingRecord && existingRecord.id) {
      await db.attendances.update(existingRecord.id, {
        present: !isPresent,
        markedAt: new Date().toISOString(),
      });
    } else {
      const { generateId } = await import('@/lib/db');
      await db.attendances.add({
        id: generateId(),
        childId,
        date: selectedDate,
        present: true,
        markedAt: new Date().toISOString(),
      });
    }
  };

  const totalPresents = attendances?.filter(a => a.present).length || 0;

  return (
    <main className="flex min-h-screen flex-col bg-gray-50">
      {/* Header Mobile */}
      <header className="bg-[#00b22d] text-white p-4 sticky top-0 z-10 shadow-md">
        <div className="flex items-center mb-4">
          <Link href="/" className="mr-4">
            <ArrowLeft className="w-6 h-6" />
          </Link>
          <h1 className="text-xl font-bold">Appel du Dimanche</h1>
        </div>
        
        {/* Sélecteur de date */}
        <div className="bg-white rounded-xl p-3 shadow-sm flex items-center justify-between text-gray-900">
          <label htmlFor="date-picker" className="font-medium text-sm text-gray-500">Date :</label>
          <input
            id="date-picker"
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            className="border-none bg-transparent focus:ring-0 font-semibold text-[#00b22d] cursor-pointer"
          />
        </div>
      </header>

      {/* Résumé stat */}
      <div className="px-4 py-3 bg-white border-b flex justify-between items-center text-sm">
        <span className="text-gray-500 font-medium">Total Présents :</span>
        <span className="font-bold text-[#00b22d] text-base px-2 py-1 bg-[#00b22d]/10 rounded-lg">
          {totalPresents} / {children?.length || 0}
        </span>
      </div>

      {/* Liste de pointage */}
      <div className="p-4 flex-1 overflow-y-auto pb-20">
        {children === undefined || attendances === undefined ? (
          <div className="flex justify-center mt-10">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#00b22d]"></div>
          </div>
        ) : children.length === 0 ? (
          <div className="text-center mt-10 text-gray-500">
            Aucun enfant enregistré.<br/>
            Allez dans l&apos;annuaire pour en ajouter.
          </div>
        ) : (
          <div className="space-y-3">
            {children.map(child => {
              const isPresent = attendanceMap.get(child.id!) || false;
              
              return (
                <Card 
                  key={child.id} 
                  padding="sm" 
                  className={`transition-colors cursor-pointer ${isPresent ? 'border-[#00b22d] bg-[#00b22d]/5' : ''}`}
                  onClick={() => child.id && toggleAttendance(child.id)}
                >
                  <CardContent className="p-0 flex items-center justify-between">
                    <div className="flex items-center">
                      {/* Avatar */}
                      <div className="w-12 h-12 rounded-full bg-gray-200 flex-shrink-0 flex items-center justify-center overflow-hidden border border-gray-300">
                        {child.photoUrl ? (
                          <Image
                            src={child.photoUrl}
                            alt={child.firstName}
                            width={48}
                            height={48}
                            className="h-full w-full object-cover"
                            unoptimized
                          />
                        ) : (
                          <User className="w-5 h-5 text-gray-400" />
                        )}
                      </div>
                      
                      {/* Nom */}
                      <div className="ml-3">
                        <h3 className="font-semibold text-gray-900">
                          {child.firstName} {child.lastName}
                        </h3>
                      </div>
                    </div>

                    {/* Check / Status */}
                    <div className="ml-2 pr-2">
                      {isPresent ? (
                        <CheckCircle2 className="w-8 h-8 text-[#00b22d]" />
                      ) : (
                        <Circle className="w-8 h-8 text-gray-300" />
                      )}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </main>
  );
}
