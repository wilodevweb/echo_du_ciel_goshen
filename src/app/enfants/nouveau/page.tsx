"use client";

import React, { useState, FormEvent, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Camera, ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Card, CardContent } from '@/components/ui/Card';
import db from '@/lib/db';

export default function AddChildPage() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    parentPhone: '',
    address: '',
    birthDate: '',
    notes: '',
  });
  const [photoUrl, setPhotoUrl] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handlePhotoCapture = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setPhotoUrl(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    
    try {
      const { generateId } = await import('@/lib/db');
      await db.children.add({
        id: generateId(),
        firstName: formData.firstName,
        lastName: formData.lastName,
        parentPhone: formData.parentPhone,
        address: formData.address,
        birthDate: formData.birthDate,
        notes: formData.notes,
        photoUrl: photoUrl,
        createdAt: new Date().toISOString(),
      });
      
      router.push('/enfants'); // Redirection vers la liste
    } catch (error) {
      console.error("Erreur lors de l'ajout", error);
      alert("Une erreur est survenue lors de l'enregistrement.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <main className="flex min-h-screen flex-col bg-gray-50 pb-10">
      {/* Header Mobile */}
      <header className="bg-[#00b22d] text-white p-4 sticky top-0 z-10 flex items-center shadow-md">
        <Link href="/" className="mr-4">
          <ArrowLeft className="w-6 h-6" />
        </Link>
        <h1 className="text-xl font-bold">Nouveau Profil</h1>
      </header>

      <div className="p-4 flex-1">
        <form onSubmit={handleSubmit} className="space-y-6">
          
          {/* Photo Section */}
          <div className="flex flex-col items-center justify-center mb-6">
            <div 
              className="w-32 h-32 rounded-full bg-gray-200 border-4 border-white shadow-md flex items-center justify-center overflow-hidden relative cursor-pointer"
              onClick={() => fileInputRef.current?.click()}
            >
              {photoUrl ? (
                <img src={photoUrl} alt="Aperçu" className="w-full h-full object-cover" />
              ) : (
                <div className="text-gray-400 flex flex-col items-center">
                  <Camera className="w-8 h-8 mb-1" />
                  <span className="text-xs">Photo</span>
                </div>
              )}
            </div>
            <input 
              type="file" 
              accept="image/*" 
              capture="environment" 
              className="hidden" 
              ref={fileInputRef}
              onChange={handlePhotoCapture}
            />
            <p className="text-sm text-[#00b22d] mt-3 font-medium cursor-pointer" onClick={() => fileInputRef.current?.click()}>
              Prendre / Choisir une photo
            </p>
          </div>

          <Card padding="md">
            <CardContent>
              <div className="grid grid-cols-2 gap-4">
                <Input 
                  label="Prénom" 
                  name="firstName" 
                  required 
                  value={formData.firstName}
                  onChange={handleChange}
                  placeholder="Ex: Jean"
                />
                <Input 
                  label="Nom" 
                  name="lastName" 
                  required 
                  value={formData.lastName}
                  onChange={handleChange}
                  placeholder="Ex: Dupont"
                />
              </div>

              <Input 
                label="Téléphone Parent" 
                name="parentPhone" 
                type="tel" 
                required 
                value={formData.parentPhone}
                onChange={handleChange}
                placeholder="Ex: 06 12 34 56 78"
                helperText="Pour contacter rapidement via l'application"
              />

              <Input 
                label="Adresse Physique" 
                name="address" 
                required 
                value={formData.address}
                onChange={handleChange}
                placeholder="Quartier, Rue..."
              />

              <Input 
                label="Date de naissance (Optionnel)" 
                name="birthDate" 
                type="date" 
                value={formData.birthDate}
                onChange={handleChange}
              />

              <div className="w-full flex flex-col mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Notes médicales / Allergies
                </label>
                <textarea 
                  name="notes"
                  className="flex w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#00b22d] focus:border-transparent"
                  rows={3}
                  value={formData.notes}
                  onChange={handleChange}
                  placeholder="Remarques éventuelles..."
                />
              </div>
            </CardContent>
          </Card>

          <Button type="submit" fullWidth size="lg" disabled={isSubmitting}>
            {isSubmitting ? "Enregistrement..." : "Ajouter l'enfant"}
          </Button>

        </form>
      </div>
    </main>
  );
}
