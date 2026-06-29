import React from 'react';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';

interface MobileHeaderProps {
  title: string;
  showBack?: boolean;
  backUrl?: string;
  rightElement?: React.ReactNode;
  className?: string;
}

export function MobileHeader({ 
  title, 
  showBack = true, 
  backUrl = "/", 
  rightElement,
  className = ""
}: MobileHeaderProps) {
  return (
    <header className={`bg-fiverr text-white p-4 sticky top-0 z-10 shadow-md flex items-center justify-between ${className}`}>
      <div className="flex items-center">
        {showBack && (
          <Link href={backUrl} className="mr-4 hover:opacity-80 transition-opacity">
            <ArrowLeft className="w-6 h-6" />
          </Link>
        )}
        <h1 className="text-xl font-bold">{title}</h1>
      </div>
      {rightElement && (
        <div className="flex items-center">
          {rightElement}
        </div>
      )}
    </header>
  );
}
