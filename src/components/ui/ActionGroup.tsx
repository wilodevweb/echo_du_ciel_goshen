import React from "react";
import Link from "next/link";
import { LucideIcon } from "lucide-react";

export interface ActionButtonDef {
  id: string;
  icon: LucideIcon;
  isActive?: boolean;
  onClick?: () => void;
  href?: string;
  title?: string;
}

export interface ActionGroupProps {
  buttons: ActionButtonDef[];
  className?: string;
}

export function ActionGroup({ buttons, className = "" }: ActionGroupProps) {
  if (buttons.length === 0) return null;

  return (
    <div className={`flex bg-white/10 rounded-xl p-1 ${className}`}>
      {buttons.map((btn) => {
        const Icon = btn.icon;
        const className = `flex items-center justify-center w-8 h-8 rounded-lg transition-all ${
          btn.isActive 
            ? "bg-fiverr text-white shadow-sm" 
            : "text-white/50 hover:text-white"
        }`;
        
        if (btn.href) {
          return (
            <Link key={btn.id} href={btn.href} title={btn.title} className={className}>
              <Icon className="w-4 h-4" />
            </Link>
          );
        }
        
        return (
          <button
            key={btn.id}
            type="button"
            onClick={btn.onClick}
            title={btn.title}
            className={className}
          >
            <Icon className="w-4 h-4" />
          </button>
        );
      })}
    </div>
  );
}
