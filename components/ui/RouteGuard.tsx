'use client';

import React, { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import { TermsAgreementModal } from './TermsAgreementModal';

interface RouteGuardProps {
  children: React.ReactNode;
}

/**
 * Guard de rutas del lado del cliente.
 * Intercepta de forma dinámica la navegación y exige la aceptación obligatoria
 * de términos y condiciones si el usuario está autenticado pero con 'has_accepted_terms' en false.
 */
export function RouteGuard({ children }: RouteGuardProps) {
  const pathname = usePathname();
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [hasAcceptedTerms, setHasAcceptedTerms] = useState(true);
  const [loading, setLoading] = useState(true);

  // Exemptar páginas públicas de autenticación para evitar bloqueos
  const isAuthPage = pathname === '/login' || pathname === '/register';

  const checkUserStatus = () => {
    if (typeof window !== 'undefined') {
      const token = localStorage.getItem('token');
      const userStr = localStorage.getItem('user');

      if (token && userStr) {
        setIsAuthenticated(true);
        try {
          const user = JSON.parse(userStr);
          // Evaluar estado de aceptación de términos
          setHasAcceptedTerms(user.has_accepted_terms === true);
        } catch {
          setHasAcceptedTerms(false);
        }
      } else {
        setIsAuthenticated(false);
        setHasAcceptedTerms(true);
      }
    }
    setLoading(false);
  };

  useEffect(() => {
    checkUserStatus();
  }, [pathname]);

  const handleTermsAccepted = () => {
    setHasAcceptedTerms(true);
    // Recargar estado local para propagar cambios en todo el árbol de componentes
    checkUserStatus();
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-surface">
        <span className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  // Interceptar la navegación: si está autenticado pero no ha aceptado términos, forzar modal
  if (!isAuthPage && isAuthenticated && !hasAcceptedTerms) {
    return (
      <>
        {/* Renderizamos el modal bloqueando la interacción con la aplicación */}
        <TermsAgreementModal onAcceptSuccess={handleTermsAccepted} />
        
        {/* Mostramos el fondo difuminado pero bloqueado */}
        <div className="filter blur-sm pointer-events-none select-none h-screen overflow-hidden">
          {children}
        </div>
      </>
    );
  }

  return <>{children}</>;
}
