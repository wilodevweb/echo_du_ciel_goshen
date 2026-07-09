"use client";

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { MobileHeader } from '@/components/ui/MobileHeader';
import { PointageCard } from '@/components/pointage/PointageCard';
import { NewChildForm, emptyNewChild } from '@/components/pointage/types';
import db, { generateId, markEntityForSync, normalizeName } from '@/lib/db';

export default function AddChildPage() {
  const router = useRouter();
  const [newChild, setNewChild] = useState<NewChildForm>(emptyNewChild);
  const [isAdding, setIsAdding] = useState(false);

  const handleAddChild = async () => {
    if (isAdding) return;

    if (!newChild.firstName.trim() || !newChild.lastName.trim()) {
      alert("Le prénom et le nom sont obligatoires.");
      return;
    }
    setIsAdding(true);

    try {
      const childId = generateId();
      await db.children.add({
        id: childId,
        firstName: normalizeName(newChild.firstName.trim()),
        lastName: normalizeName(newChild.lastName.trim()),
        postName: normalizeName(newChild.postName.trim()),
        gender: newChild.gender,
        classLevel: newChild.classLevel,
        parentPhone: newChild.parentPhone.trim(),
        parentFirstName: normalizeName(newChild.parentFirstName.trim()),
        parentLastName: normalizeName(newChild.parentLastName.trim()),
        address: newChild.address.trim(),
        birthDate: newChild.birthDate || undefined,
        notes: newChild.notes.trim(),
        photoUrl: newChild.photoUrl,
        createdAt: new Date().toISOString(),
      });
      await markEntityForSync('child', childId, [
        'firstName',
        'lastName',
        'postName',
        'gender',
        'classLevel',
        'parentPhone',
        'parentFirstName',
        'parentLastName',
        'address',
        'birthDate',
        'notes',
        'photoUrl',
        'parentId',
      ]);
      
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
      <MobileHeader title="Nouveau Profil" backUrl="/enfants" />

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
