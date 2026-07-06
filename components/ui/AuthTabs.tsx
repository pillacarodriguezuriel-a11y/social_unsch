'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

/**
 * Componente de navegación Dual-Tab (Login / Register) para la pasarela de acceso.
 * Muestra una línea Crimson Profundo debajo de la opción activa.
 */
export function AuthTabs() {
  const pathname = usePathname();
  const isLogin = pathname === '/login';

  return (
    <div className="flex border-b border-secondary/20 mb-6">
      <Link
        href="/login"
        className={`flex-1 text-center py-3 text-sm font-bold transition-all relative ${
          isLogin 
            ? 'text-primary' 
            : 'text-neutral-gray/60 hover:text-neutral-gray'
        }`}
      >
        Iniciar Sesión
        {isLogin && (
          <span className="absolute bottom-[-1px] left-0 right-0 h-0.5 bg-primary rounded-full" />
        )}
      </Link>
      <Link
        href="/register"
        className={`flex-1 text-center py-3 text-sm font-bold transition-all relative ${
          !isLogin 
            ? 'text-primary' 
            : 'text-neutral-gray/60 hover:text-neutral-gray'
        }`}
      >
        Registrarse
        {!isLogin && (
          <span className="absolute bottom-[-1px] left-0 right-0 h-0.5 bg-primary rounded-full" />
        )}
      </Link>
    </div>
  );
}
