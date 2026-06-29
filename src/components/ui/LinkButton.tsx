import React from 'react';
import Link from 'next/link';
import { LucideIcon } from 'lucide-react';

interface LinkButtonProps {
  href: string;
  icon?: LucideIcon;
  children: React.ReactNode;
  variant?: 'primary' | 'outline' | 'default';
  className?: string;
  fullWidth?: boolean;
}

export function LinkButton({ 
  href, 
  icon: Icon, 
  children, 
  variant = 'default',
  className = '',
  fullWidth = false
}: LinkButtonProps) {
  
  const baseStyles = "flex items-center justify-center gap-2 rounded-xl transition-all active:scale-[0.98] font-bold";
  const widthStyles = fullWidth ? "w-full" : "";
  
  const variants = {
    primary: "h-16 bg-fiverr text-white shadow-md hover:bg-fiverr-dark text-lg px-5",
    outline: "h-14 border border-gray-200 bg-white text-gray-800 hover:bg-gray-50 text-sm",
    default: "h-14 bg-gray-100 text-gray-900 hover:bg-gray-200 text-sm",
  };

  return (
    <Link href={href} className={`${baseStyles} ${widthStyles} ${variants[variant]} ${className}`}>
      {Icon && <Icon className={`h-5 w-5 ${variant === 'outline' ? 'text-fiverr' : ''} ${variant === 'primary' ? 'h-6 w-6' : ''}`} />}
      {children}
    </Link>
  );
}
