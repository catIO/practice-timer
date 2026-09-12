import React from 'react';

interface SettingRowProps {
  label: string;
  description?: string;
  icon?: string;
  htmlFor?: string;
  children: React.ReactNode;
  className?: string;
}

export function SettingRow({
  label,
  description,
  icon,
  htmlFor,
  children,
  className = '',
}: SettingRowProps) {
  return (
    <div className={`flex flex-col sm:flex-row sm:items-center justify-between gap-3 py-2 ${className}`}>
      <div className="flex items-start gap-3">
        {icon && (
          <span className="material-icons text-muted-foreground text-lg mt-0.5 shrink-0 select-none">
            {icon}
          </span>
        )}
        <div>
          <label
            htmlFor={htmlFor}
            className="text-sm font-medium text-foreground cursor-pointer select-none"
          >
            {label}
          </label>
          {description && (
            <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">
              {description}
            </p>
          )}
        </div>
      </div>
      <div className="shrink-0 flex items-center gap-2 self-end sm:self-auto">
        {children}
      </div>
    </div>
  );
}
