import React from 'react';

interface SettingCardProps {
  title: string;
  description?: string;
  icon?: string;
  children: React.ReactNode;
  className?: string;
}

export function SettingCard({
  title,
  description,
  icon,
  children,
  className = '',
}: SettingCardProps) {
  return (
    <div className={`bg-card border border-white/5 rounded-2xl p-6 space-y-6 ${className}`}>
      <div className="flex items-center gap-3">
        {icon && (
          <div className="w-9 h-9 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
            <span className="material-icons text-lg">{icon}</span>
          </div>
        )}
        <div>
          <h2 className="text-base font-semibold text-foreground tracking-tight">{title}</h2>
          {description && (
            <p className="text-xs text-muted-foreground mt-0.5">{description}</p>
          )}
        </div>
      </div>
      <div className="space-y-4">
        {children}
      </div>
    </div>
  );
}
