"use client";

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { PointageCard } from '@/components/pointage/PointageCard';
import { NewChildForm, emptyNewChild } from '@/components/pointage/types';
import db, { generateId, markEntityForSync, type AttendanceStatus } from '@/lib/db';

export default function AddChildPage() {
  const router = useRouter();
  const [newChild, setNewChild] = useState<NewChildForm>(emptyNewChild);
  const [isAdding, setIsAdding] = useState(false);

  const handleAddChild = async (status: AttendanceStatus) => {
    setIsAdding(true);

    try {
      const childId = generateId();
      await db.children.add({
        id: childId,
        firstName: newChild.firstName.trim(),
        lastName: newChild.lastName.trim(),
        postName: newChild.postName.trim(),
        gender: newChild.gender,
        classLevel: newChild.classLevel,
        parentPhone: "",
        parentFirstName: "",
        parentLastName: "",
        address: "",
        createdAt: new Date().toISOString(),
      });
      await markEntityForSync('child', childId);
      
      // Redirection vers l'annuaire avec l'ID du nouvel enfant pour afficher son profil
      router.push(`/enfants?newChildId=${childId}`);
    } catch (error) {
      console.error("Erreur lors de l'enregistrement", error);
      alert("Une erreur est survenue lors de l'enregistrement.");
    } finally {
      setIsAdding(false);
    }
  };

  return (
    <main className="flex min-h-screen flex-col bg-gray-50 pb-10">
      {/* Header Mobile */}
      <header className="bg-[#00b22d] text-white p-4 sticky top-0 z-10 flex items-center shadow-md">
        <Link href="/enfants" className="mr-4">
          <ArrowLeft className="w-6 h-6" />
        </Link>
        <h1 className="text-xl font-bold">Nouveau Profil</h1>
      </header>

      <div className="p-4 flex-1 flex items-center justify-center">
        <div className="w-full max-w-md">
          <PointageCard
            mode="add"
            value={newChild}
            isAdding={isAdding}
            onChange={setNewChild}
            onSubmit={handleAddChild}
          />
        </div>
      </div>
    </main>
  );
}
