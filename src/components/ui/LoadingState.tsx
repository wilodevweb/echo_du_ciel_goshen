import React from 'react';

export function LoadingState({ message = "Chargement..." }: { message?: string }) {
  return (
    <div className="flex flex-col items-center justify-center p-10 mt-10">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-fiverr mb-4"></div>
      <p className="text-gray-500 text-sm">{message}</p>
    </div>
  );
}
