import React from 'react';
import { ShieldAlert, Info, AlertTriangle } from 'lucide-react';

interface AlertProps {
  title: string;
  description: string;
  variant?: 'warning' | 'info' | 'error';
  className?: string;
  children?: React.ReactNode;
}

/**
 * Componente de alerta didáctica del sistema.
 * Ideal para mensajes de exclusividad, advertencias de dominio o avisos de seguridad.
 */
export function Alert({
  title,
  description,
  variant = 'error',
  className = '',
  children,
}: AlertProps) {
  // Configuración de colores basada en los tokens del Crimson Heritage (y el azul de notificaciones técnicas)
  const variants = {
    error: 'bg-primary/5 border border-primary/20 text-primary',
    warning: 'bg-secondary/10 border border-secondary/20 text-primary',
    info: 'bg-tertiary/5 border border-tertiary/20 text-tertiary',
  };

  const icons = {
    error: <ShieldAlert className="w-5 h-5 flex-shrink-0" />,
    warning: <AlertTriangle className="w-5 h-5 flex-shrink-0" />,
    info: <Info className="w-5 h-5 flex-shrink-0" />,
  };

  return (
    <div className={`p-4 rounded-xl flex gap-3 text-left ${variants[variant]} ${className}`}>
      {icons[variant]}
      <div className="flex flex-col gap-1 w-full">
        <h4 className="text-sm font-bold tracking-tight">{title}</h4>
        <p className="text-xs leading-relaxed font-medium opacity-90">{description}</p>
        {children && <div className="mt-2.5">{children}</div>}
      </div>
    </div>
  );
}
