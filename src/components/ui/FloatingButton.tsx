import React from 'react';
import Link from 'next/link';
import { LucideIcon } from 'lucide-react';

interface FloatingButtonProps {
  href: string;
  icon: LucideIcon;
  variant?: 'white' | 'purple' | 'green';
  title?: string;
  className?: string;
}

export function FloatingButton({ 
  href, 
  icon: Icon, 
  variant = 'white',
  title,
  className = ''
}: FloatingButtonProps) {
  
  const variants = {
    white: "border border-gray-200 bg-white text-gray-600 hover:bg-gray-50",
    purple: "bg-purple-600 text-white hover:bg-purple-700",
    green: "bg-fiverr text-white hover:bg-fiverr-dark",
  };

  return (
    <Link
      href={href}
      className={`flex h-12 w-12 items-center justify-center rounded-full transition-all active:scale-90 shadow-sm ${variants[variant]} ${className}`}
      title={title}
    >
      <Icon className="h-5 w-5" />
    </Link>
  );
}
